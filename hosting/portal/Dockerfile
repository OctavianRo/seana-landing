FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY hosting/portal/package.json hosting/portal/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY hosting/portal/server.cjs ./server.cjs
COPY portal /srv/portal
COPY hosting/portal/secure-origin.js /srv/portal/secure-origin.js
USER node
EXPOSE 8080
CMD ["node", "server.cjs"]
