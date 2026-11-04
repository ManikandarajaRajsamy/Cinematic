#!/usr/bin/env bash
# Deploys the built site (dist/) to a private S3 bucket served through CloudFront.
# Safe to re-run: it creates the bucket, access control and distribution only once, then uploads and invalidates.
# Usage: bash deploy/aws-deploy.sh            (needs `aws configure` done first)
set -euo pipefail

AWS="${AWS:-aws}"
command -v "$AWS" >/dev/null || AWS="/c/Program Files/Amazon/AWSCLIV2/aws.exe"
REGION="${REGION:-ap-southeast-2}"  # this account only allows certain regions; CloudFront serves India from local edges
ACCOUNT=$("$AWS" sts get-caller-identity --query Account --output text)
BUCKET="${BUCKET:-ssp-web-$ACCOUNT}"
TAG="ssp-web"   # CloudFront comment used to find the distribution again
SITE="${SITE:-srisasthaparuthipaal.in}"

cd "$(dirname "$0")/.."
echo "Account $ACCOUNT · region $REGION · bucket $BUCKET"

echo "== build"
npm run build

echo "== bucket"
if ! "$AWS" s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  "$AWS" s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
fi
"$AWS" s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "== origin access control"
OAC=$("$AWS" cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='$TAG'].Id | [0]" --output text)
if [ "$OAC" = "None" ] || [ -z "$OAC" ]; then
  OAC=$("$AWS" cloudfront create-origin-access-control --origin-access-control-config \
    "Name=$TAG,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" --query OriginAccessControl.Id --output text)
fi

echo "== certificate ($SITE, www.$SITE)"
# CloudFront only accepts ACM certificates from us-east-1; validated by DNS records added in Cloudflare
CERT=$("$AWS" acm list-certificates --region us-east-1 --certificate-statuses PENDING_VALIDATION ISSUED \
  --query "CertificateSummaryList[?DomainName=='$SITE'].CertificateArn | [0]" --output text)
if [ "$CERT" = "None" ] || [ -z "$CERT" ]; then
  CERT=$("$AWS" acm request-certificate --region us-east-1 --domain-name "$SITE" \
    --subject-alternative-names "www.$SITE" --validation-method DNS --query CertificateArn --output text)
  sleep 10  # validation records take a moment to appear
fi
CERT_STATUS=$("$AWS" acm describe-certificate --region us-east-1 --certificate-arn "$CERT" --query Certificate.Status --output text)
if [ "$CERT_STATUS" != "ISSUED" ]; then
  echo "Certificate is $CERT_STATUS. Add these CNAME records in Cloudflare (DNS only, grey cloud), then re-run:"
  "$AWS" acm describe-certificate --region us-east-1 --certificate-arn "$CERT" \
    --query "Certificate.DomainValidationOptions[].ResourceRecord.[Name,Value]" --output text | sort -u
  exit 0
fi

# AWS managed "SecurityHeadersPolicy": HSTS, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff,
# Referrer-Policy strict-origin-when-cross-origin, X-XSS-Protection
HEADERS_POLICY="67f7725c-6f97-4210-82d7-5512b31e9d03"

echo "== distribution"
DIST=$("$AWS" cloudfront list-distributions --query "DistributionList.Items[?Comment=='$TAG'].Id | [0]" --output text)
if [ "$DIST" = "None" ] || [ -z "$DIST" ]; then
  # CachingOptimized managed policy; 403/404 fall back to index.html so React Router deep links work
  CFG=$(mktemp)
  cat > "$CFG" <<JSON
{
  "CallerReference": "$TAG-$(date +%s)",
  "Comment": "$TAG",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "HttpVersion": "http2and3",
  "PriceClass": "PriceClass_200",
  "Aliases": { "Quantity": 2, "Items": ["$SITE", "www.$SITE"] },
  "ViewerCertificate": { "ACMCertificateArn": "$CERT", "SSLSupportMethod": "sni-only", "MinimumProtocolVersion": "TLSv1.2_2021" },
  "Origins": { "Quantity": 1, "Items": [{
    "Id": "s3", "DomainName": "$BUCKET.s3.$REGION.amazonaws.com", "OriginAccessControlId": "$OAC",
    "S3OriginConfig": { "OriginAccessIdentity": "" } }] },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3", "ViewerProtocolPolicy": "redirect-to-https", "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "ResponseHeadersPolicyId": "$HEADERS_POLICY",
    "AllowedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
  },
  "CustomErrorResponses": { "Quantity": 2, "Items": [
    { "ErrorCode": 403, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0 },
    { "ErrorCode": 404, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0 } ] }
}
JSON
  DIST=$("$AWS" cloudfront create-distribution --distribution-config "file://$(cygpath -m "$CFG")" --query Distribution.Id --output text)
  rm -f "$CFG"
else
  # an existing distribution: attach the security headers policy once
  CUR=$("$AWS" cloudfront get-distribution-config --id "$DIST" --query DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId --output text)
  if [ "$CUR" != "$HEADERS_POLICY" ]; then
    echo "   attaching security headers"
    RAW=$(mktemp); "$AWS" cloudfront get-distribution-config --id "$DIST" --output json > "$RAW"
    ETAG=$(python -c "import json,sys; print(json.load(open(sys.argv[1]))['ETag'])" "$(cygpath -m "$RAW")")
    python -c "import json,sys; d=json.load(open(sys.argv[1]))['DistributionConfig']; d['DefaultCacheBehavior']['ResponseHeadersPolicyId']=sys.argv[2]; json.dump(d,open(sys.argv[1],'w'))" "$(cygpath -m "$RAW")" "$HEADERS_POLICY"
    "$AWS" cloudfront update-distribution --id "$DIST" --if-match "$ETAG" --distribution-config "file://$(cygpath -m "$RAW")" >/dev/null
    rm -f "$RAW"
  fi
fi

echo "== bucket policy (CloudFront only)"
POL=$(mktemp)
cat > "$POL" <<JSON
{ "Version": "2012-10-17", "Statement": [{
  "Effect": "Allow", "Principal": { "Service": "cloudfront.amazonaws.com" },
  "Action": "s3:GetObject", "Resource": "arn:aws:s3:::$BUCKET/*",
  "Condition": { "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::$ACCOUNT:distribution/$DIST" } } }] }
JSON
"$AWS" s3api put-bucket-policy --bucket "$BUCKET" --policy "file://$(cygpath -m "$POL")"
rm -f "$POL"

echo "== upload"
# hashed assets and media are cached for a year; index.html is always revalidated
"$AWS" s3 sync dist/ "s3://$BUCKET/" --delete --exclude index.html --cache-control "public,max-age=31536000,immutable"
"$AWS" s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control "no-cache" --content-type "text/html"

echo "== invalidate"
"$AWS" cloudfront create-invalidation --distribution-id "$DIST" --paths "/index.html" "/" >/dev/null

DOMAIN=$("$AWS" cloudfront get-distribution --id "$DIST" --query Distribution.DomainName --output text)
echo "Done: https://$DOMAIN  (a new distribution takes 5-15 minutes to go live)"
echo "In Cloudflare point CNAME '@' and 'www' to $DOMAIN, then set SSL/TLS mode to Full (strict)."
