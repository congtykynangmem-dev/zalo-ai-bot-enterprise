FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev
RUN npm install pg@^8.13.3 --no-save

# Copy application source code
COPY . .

# Expose server port
EXPOSE 3000

ENV NODE_ENV=production

# Start command
CMD ["node", "server.js"]

