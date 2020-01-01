FROM node:alpine
WORKDIR /code
ENTRYPOINT [ "sh", "-c", "npm --unsafe-perm install && npm test && npm --unsafe-perm pack"]