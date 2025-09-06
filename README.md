# PayFree

**PayFree web application link**: https://payfree.live

**YouTube instructions** on using the web application: https://youtu.be/qN7n4XTbbWM

PayFree is a full-stack web application for **tracking shared holiday expenses** among friends.  
It allows you to log trip expenses, calculate who owes whom, and settle debts easily.

---

## ✨ Features

- 🧾 **Trip Creation** – Create trips and invite friends to join.
- 💸 **Expense Tracking** – Log who paid for what, with amount and currency.
- 🔄 **Debt Calculation** – Automatically figures out who owes whom.
- ✅ **Settlement Flow** – Record payments and mark debts as settled.
- 🔐 **Authentication** – Secure login via email/password or Google OAuth.
- 🌍 **Multi-currency Support** – Choose currency for each trip.
- 🖥 **Responsive UI** – Optimized for desktop and mobile.

---

## 🛠 Tech Stack

**Frontend**

- [React](https://react.dev/) (CRA)
- React Router (protected routes)
- CSS Modules

**Backend**

- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- JWT Authentication (email/password + Google OAuth)
- [PostgreSQL](https://www.postgresql.org/) via `pg` pool

**Infrastructure**

- Dockerized backend & frontend
- Nginx (serving React build)
- Traefik (reverse proxy, HTTPS with Let’s Encrypt)
- AWS Lightsail (hosting)
