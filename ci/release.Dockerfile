FROM node:alpine
ARG npm_auth_token
WORKDIR /artifacts
RUN echo "//registry.npmjs.org/:_authToken=${npm_auth_token}" > ~/.npmrc
ENTRYPOINT [ "sh", "-c", "[[ \"$BRANCH_NAME\" = \"master\" ]] && npm publish *.tgz || npm publish *.tgz --tag alpha" ]