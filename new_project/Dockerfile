FROM node:18-alpine
WORKDIR /home/newproc

COPY package*.json ./
RUN npm install

COPY . /home/newproc
EXPOSE 3000
CMD ["node","server.js"]