#!/usr/bin/env bash
# Deploys dist/ to the public S3 website bucket behind Cloudflare (proxied, SSL Flexible for this host).
# Used while CloudFront is unavailable on this account; aws-deploy.sh is the CloudFront version.
# Usage: bash deploy/aws-s3-website.sh            (needs `aws configure` done first)
set -euo pipefail

AWS="${AWS:-aws}"
command -v "$AWS" >/dev/null || AWS="/c/Program Files/Amazon/AWSCLIV2/aws.exe"
BUCKET="${BUCKET:-srisasthaparuthipaal.in}"   # must equal the domain: Cloudflare forwards it as the Host header

cd "$(dirname "$0")/.."

echo "== build"
npm run build

echo "== upload"
# hashed assets and media are cached for a year; index.html is always revalidated
"$AWS" s3 sync dist/ "s3://$BUCKET/" --delete --exclude index.html --cache-control "public,max-age=31536000,immutable"
"$AWS" s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control "no-cache" --content-type "text/html"

echo "Done: http://$BUCKET.s3-website-ap-southeast-2.amazonaws.com"
echo "Purge the Cloudflare cache (Caching > Configuration > Purge Everything) if the old version still shows."
