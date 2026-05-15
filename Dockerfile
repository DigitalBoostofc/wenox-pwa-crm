# build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_PB_URL=https://api.wenox.com.br
ENV VITE_PB_URL=$VITE_PB_URL
# VPS 4GB: limita heap do Node e roda só o vite build (typecheck fica no CI/local)
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build:ci

# serve
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
