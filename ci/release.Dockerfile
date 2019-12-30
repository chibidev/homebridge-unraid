FROM node:alpine
ARG npm_auth_token
WORKDIR /artifacts
RUN echo "//registry.npmjs.org/:_authToken=${npm_auth_token}" > ~/.npmrc
ENTRYPOINT [ "npm", "publish", "*.tgz" ]