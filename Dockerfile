FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY config ./config
EXPOSE 8787
CMD ["node", "src/server.js"]
