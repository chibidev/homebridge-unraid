FROM node:alpine
WORKDIR /code
RUN npm i -g typescript
ENTRYPOINT [ "sh", "-c", "npm --unsafe-perm install && npm --unsafe-perm pack"]