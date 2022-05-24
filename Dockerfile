FROM twilio/twilio-cli:latest
ARG ACCOUNT_SID=sid
ARG AUTH_TOKEN=token
ARG COUNTRY_CODE=US

RUN twilio plugins:install @twilio-labs/plugin-serverless

WORKDIR /hls-pam-install
COPY . /hls-pam-install
RUN npm install

EXPOSE 3000

CMD ["twilio", "serverless:start", "--load-local-env"]
