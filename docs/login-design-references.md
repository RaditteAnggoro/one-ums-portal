# Login references and selected design

Reviewed source from the official [shadcn/ui repository](https://github.com/shadcn-ui/ui):

- [login-01](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/blocks/login-01/page.tsx): centred, bounded form, little competing content. Recommended for One UMS's operational/company login.
- [login-02](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/blocks/login-02/page.tsx): split layout with a side image, suitable when a company needs stronger branding. Avoid promotional filler in a routine operations portal.

Selected: the restrained login-01 arrangement using One UMS's existing components and authentication. No copied authentication backend, unused social-login controls or new styling framework. The large promotional hero and permanent demo/test callout were removed. Email/password start empty; reveal-password and language selection are available. Demo shortcuts require the explicit build flag NEXT_PUBLIC_DEMO_ACCOUNTS=true and are off by default; default/server builds do not expose them. Password recovery/SSO are not advertised before implementation.

Structural inspiration is credited in CREDITS.md; original implementation and provenance are recorded in AUTHORS.md and application metadata/About. No hidden tracking or access mechanism is added.
