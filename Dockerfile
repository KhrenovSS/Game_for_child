FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server ./server
COPY public ./public
COPY tools ./tools
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]
