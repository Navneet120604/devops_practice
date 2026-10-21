FROM node:18-alpine
WORKDIR /home/docvol

COPY package*.json ./
RUN npm install

COPY . /home/docvol
EXPOSE 3002
CMD ["node","server.js"]