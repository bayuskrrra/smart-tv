FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm install

# Copy Prisma schema and generate client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copy application source
COPY backend/src ./src
COPY backend/uploads ./uploads

# Hugging Face Spaces uses port 7860
EXPOSE 7860
ENV PORT=7860

CMD ["node", "src/server.js"]
