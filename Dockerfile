FROM mcr.microsoft.com/playwright:v1.58.2-noble
WORKDIR /work
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
CMD ["npm","test"]
