FROM node:20-alpine AS builder

WORKDIR /app

ENV CI=true
ENV VITE_API_BASE_URL=/api

RUN apk add --no-cache tzdata

RUN mkdir -p /app/apps/frontend

WORKDIR /app/apps/frontend

COPY package.json ./
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY public ./public
COPY src ./src

RUN cat <<'EOF' > /app/tsconfig.base.json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "CommonJS",
		"moduleResolution": "node",
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"forceConsistentCasingInFileNames": true,
		"resolveJsonModule": true
	}
}
EOF

RUN npm install
RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
