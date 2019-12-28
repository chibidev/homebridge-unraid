FROM node:alpine
WORKDIR /code
RUN npm i -g typescript
ENTRYPOINT [ "sh", "-c", "npm install && npm pack"]