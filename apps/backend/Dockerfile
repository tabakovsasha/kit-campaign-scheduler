FROM node:20-alpine AS builder

WORKDIR /app

ENV CI=true
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voximplant_scheduler

RUN apk add --no-cache tzdata openssl curl

COPY package.json ./
COPY nest-cli.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN cat <<'EOF' > /tsconfig.base.json
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
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npx nest build


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Moscow

RUN apk add --no-cache tzdata openssl curl

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000

CMD ["./docker-entrypoint.sh"]