Create a .env file in the project root with your API base URL.

For CRA-style:
REACT_APP_API_BASE_URL=https://shivtech-portal-backend.onrender.com

For Vite (this project uses Vite):
VITE_API_URL=https://shivtech-portal-backend.onrender.com

The code uses src/utils/api.ts which reads VITE_API_URL.

