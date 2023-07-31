# inz-smc-subscribe-jobs

# SCRIPT SUBSCRIBE TOPICS

- ENV

```
REDIS_URL=<redis_url>
WSS_BASE_RPC=<websocket_base_rpc>
HTTP_BASE_RPC=<http_base_rpc>
CELERY_BROKER_URL=<broker_url>
```

- Run:
```sh
node script/subscribe.js --fromBlock=3304842 --taskNames=worker.on_mint_nft --eventFileNames=TokenCreated.json topics=0x982356893a0e3295378991b6ae7b7d4b6867833c4e38d5b1ccdeb8bdd185f29e --httpRpc=HTTP_BASE_RPC --wssRpc=WSS_BASE_RPC
```

- Note:
    - fromBlock: start run if this is first time or want to scan fromBlock
    - taskNames: list task to send for consume worker ex: worker.on_mint_nft,worker.on_transfer_nft
    - eventFileNames: list file to get event_type for parse log data. ex: TokenCreated.json
    - topics: list topics handle.
    - httpRpc: http rpc to scan pastLog
    - wssRpc: websocket rpc to subscribe