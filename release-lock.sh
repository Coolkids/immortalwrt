#!/usr/bin/env bash
set -euo pipefail

FEEDS_FILE="feeds.conf.default"
VERSION_FILE="include/version.mk"

# 版本号：vYYYY.MM.DD
VERSION_NUMBER="v$(date +%Y.%m.%d)"

echo "[INFO] Release version: ${VERSION_NUMBER}"

########################################
# 1. 锁定 feeds
########################################

tmp_file=$(mktemp)

while IFS= read -r line; do
    if [[ "$line" =~ ^src-git ]]; then
        name=$(echo "$line" | awk '{print $2}')
        url=$(echo "$line" | awk '{print $3}')

        base_url=$(echo "$url" | sed -E 's/[\^;].*$//')

        echo "[INFO] Locking $name"

        commit=$(git ls-remote "$base_url" HEAD | awk '{print $1}')

        if [[ -z "$commit" ]]; then
            echo "[ERROR] Failed to fetch commit for $name"
            exit 1
        fi

        echo "src-git $name ${base_url}^${commit}" >> "$tmp_file"
    else
        echo "$line" >> "$tmp_file"
    fi
done < "$FEEDS_FILE"

mv "$tmp_file" "$FEEDS_FILE"

########################################
# 2. 修改 version.mk
########################################

# 替换整行
sed -i -E \
"s#^VERSION_NUMBER:=.*SNAPSHOT.*#VERSION_NUMBER:=\$(if \$(VERSION_NUMBER),\$(VERSION_NUMBER),${VERSION_NUMBER})#" \
"$VERSION_FILE"
echo "[INFO] version.mk updated"

########################################
# 输出版本号（给 CI 用）
########################################
echo "VERSION=${VERSION_NUMBER}" >> $GITHUB_ENV
echo "${VERSION_NUMBER}" > .release_version
