FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 3001
CMD ["dumb-init", "node", "src/index.js"]
