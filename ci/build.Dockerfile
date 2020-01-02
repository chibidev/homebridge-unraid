FROM node:alpine
WORKDIR /code
RUN apk add --no-cache git
ENTRYPOINT [ "sh", "-c", "([[ \"$BRANCH_NAME\" != \"refs/heads/master\" ]] && npm version --no-git-tag-version prerelease --preid=$(git rev-parse --short HEAD) || true) && npm --unsafe-perm install && npm test && npm --unsafe-perm pack"]