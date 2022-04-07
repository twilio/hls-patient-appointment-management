FROM twilio/twilio-cli:latest
ARG TWILIO_ACCOUNT_SID=sid
ARG TWILIO_AUTH_TOKEN=token

RUN twilio plugins:install @twilio-labs/plugin-serverless

WORKDIR /hls-pam-install
COPY . /hls-pam-install
RUN npm install
RUN cp .env.example .env

EXPOSE 3000

CMD ["twilio", "serverless:start", "--load-local-env"]
