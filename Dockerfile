FROM node:20-alpine

RUN addgroup -S gateherald && adduser -S -G gateherald gateherald

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R gateherald:gateherald /app
USER gateherald

EXPOSE 3000

CMD ["node", "index.js"]
