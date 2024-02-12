FROM node:18

WORKDIR /usr/src/app
COPY package*.json tsconfig.json ./
RUN npm install
COPY ./src ./src
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
