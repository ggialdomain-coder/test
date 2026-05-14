FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["npm", "run", "audit:server"]
