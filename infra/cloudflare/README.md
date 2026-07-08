# Cloudflare Tunnel

This project is set up to run Cloudflare Tunnel as an optional Docker Compose profile.

## Dashboard Token Flow

1. Add your domain to Cloudflare.
2. In Cloudflare Zero Trust, create a Tunnel.
3. Choose Docker as the connector type.
4. Copy the tunnel token.
5. Put the token in `.env`:

```env
CLOUDFLARE_TUNNEL_TOKEN=your-token
```

6. Configure the tunnel public hostname in Cloudflare:

```text
Hostname: jurgensenergy.com
Service:  http://caddy:80

Hostname: admin.jurgensenergy.com
Service:  http://caddy:80

Hostname: seller.jurgensenergy.com
Service:  http://caddy:80
```

7. Start the public stack:

```bash
npm run selfhost:start:public
```

Traffic path:

```text
Internet
-> Cloudflare DNS / Tunnel
-> cloudflared container
-> Caddy container
-> Next.js container
-> Postgres / Redis / local storage
```

## Local Public Test

Before using Cloudflare Tunnel, test the Docker stack locally:

```bash
npm run selfhost:bootstrap
npm run selfhost:start
```

Then open:

```text
http://localhost:3010
```

After the local Docker stack works, switch to:

```bash
npm run selfhost:start:public
```
