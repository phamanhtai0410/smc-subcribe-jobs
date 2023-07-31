FROM 968557029040.dkr.ecr.ap-southeast-1.amazonaws.com/esollabs/cicd:sh-python-ba4ec63-dirty as init
ARG base_img

FROM $base_img

COPY . .

ENTRYPOINT python main.py