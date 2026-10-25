# Expense Voucher Management System

## About the Project

The Expense Voucher Management System is a web application developed to make the process of submitting, reviewing, and managing employee expenses easier.

In a manual process, expense vouchers can be difficult to track, receipts may get misplaced, and approval status may not always be clear. This project provides a central place where employees can submit expense details, directors can review and approve or reject requests, and the accounts team can view vouchers for further processing.

The project was developed using React, Node.js, Express.js, and PostgreSQL.

## Features

### Employee

Employees can:
- Register and log in to their accounts.
- Create expense vouchers with details such as title, amount, category, date, and description.
- Edit or delete vouchers while they are still in draft status.
- Upload receipts as supporting documents.
- Add a signature before submitting a voucher.
- Check the current status of their vouchers.

### Director

The director can:
- View vouchers submitted for approval.
- Review voucher information and attached receipts.
- Approve or reject a voucher.
- Add a signature when making an approval decision.
- Provide a reason when rejecting a voucher.

### Accounts Team

The accounts team can:
- View vouchers submitted by employees.
- Check voucher details and approval status.
- View available receipts.
- Access voucher information without changing or approving vouchers.

## Technologies Used

- **Frontend:** React and Vite
- **Backend:** Node.js and Express.js
- **Database:** PostgreSQL
- **Authentication:** JSON Web Tokens (JWT)
- **Password Hashing:** bcrypt
- **Receipt Uploads:** Multer
- **Version Control:** Git and GitHub

## Project Structure

The project is divided into two main parts: the frontend and the backend. Database documentation is maintained separately.

```text
expense-voucher-system/
├── frontend/
│   └── src/
├── backend/
│   ├── routes/
│   ├── uploads/
│   ├── db.js
│   ├── server.js
│   └── .env.example
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

The `frontend` folder contains the user interface. The `backend` folder contains the API routes, authentication, and database connection. The `database` folder contains the SQL schema used to create the database tables.

## Getting Started

Follow these steps to run the project on your computer.

### Requirements

Before starting, make sure you have installed:

- Node.js and npm
- PostgreSQL
- Git
- Visual Studio Code or another code editor

### 1. Clone the Repository

Open your terminal and run:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd expense-voucher-system
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the URL of your GitHub repository.

### 2. Set Up the Database

Open PostgreSQL and create a database named:

```sql
CREATE DATABASE expense_voucher_db;
```

Create the database tables by running the SQL statements in `database/schema.sql` using pgAdmin or the PostgreSQL command-line tool.

Make sure the database user configured for the application has permission to connect to the database and access its tables.

### 3. Configure the Backend

Open a terminal in the project folder and run:

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` folder. Use `.env.example` as a reference and add your own local database credentials.

Example configuration:

```env
PORT=5001
DATABASE_URL=postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/expense_voucher_db
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
```

Replace the example values with your actual local settings. Use a strong, private JWT secret and do not upload the real `.env` file to GitHub.

Start the backend server:

```bash
npm run dev
```

The backend should be available at `http://localhost:5001`.

You can check whether the server is running by visiting:

`http://localhost:5001/api/health`

### 4. Configure the Frontend

Open a second terminal from the project root and run:

```bash
cd frontend
npm install
npm run dev
```

Vite will display the local address for the application. By default, it is:

`http://localhost:5173`

Open that address in your browser to use the application.

## How the System Works

The usual voucher process is:

1. An employee creates a voucher and enters the expense details.
2. The employee can attach a receipt and add a signature.
3. The employee submits the voucher for approval.
4. The director reviews the submitted voucher and approves or rejects it.
5. If the voucher is rejected, the director provides a reason.
6. The accounts team can view vouchers and their current status.

The application uses different roles to control which features each user can access.

## Database Schema

The PostgreSQL database stores the information needed to manage users, vouchers, signatures, and approval decisions.

| Table | Purpose |
|---|---|
| `users` | Stores user details, password hashes, email addresses, and roles. |
| `vouchers` | Stores expense details, employee ownership, voucher status, and receipt path. |
| `voucher_signatures` | Stores employee signatures associated with vouchers. |
| `approvals` | Stores director decisions, signatures, and rejection reasons. |

The database uses relationships between users, vouchers, signatures, and approvals to associate each voucher with its employee and approval history.

The `schema.sql` file should contain the table definitions, foreign keys, constraints, and indexes required to recreate the database.

## API Documentation

The backend exposes REST API endpoints that the frontend uses to communicate with the database.

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Register an employee account. |
| `POST` | `/api/auth/login` | Log in and receive an authentication token. |

### Employee Vouchers

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/vouchers` | View the authenticated employee's vouchers. |
| `POST` | `/api/vouchers` | Create a voucher. |
| `PUT` | `/api/vouchers/:id` | Update a draft voucher. |
| `DELETE` | `/api/vouchers/:id` | Delete a draft voucher. |
| `POST` | `/api/vouchers/:id/attachment` | Upload a receipt. |
| `POST` | `/api/vouchers/:id/sign` | Save the employee's signature. |
| `POST` | `/api/vouchers/:id/submit` | Submit a voucher for approval. |

### Director

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/director/pending` | View vouchers awaiting approval. |
| `POST` | `/api/director/:id/approve` | Approve a voucher. |
| `POST` | `/api/director/:id/reject` | Reject a voucher. |

### Accounts and Attachments

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/accounts/vouchers` | View vouchers as an accounts user. |
| `GET` | `/api/attachments/:id` | Retrieve a receipt when the user is authorized to access it. |

Protected endpoints require an authentication token in the request's `Authorization` header, using the `Bearer` format. The backend checks the user's role and permissions before allowing protected actions.

## Demo Login Credentials

The following demo accounts can be used to test the different roles in the application.

| Role | Email | Password |
|---|---|---|
| Employee | `employee@example.com` | `TestPassword123!` |
| Director | `director@example.com` | `DirectorPassword123!` |
| Accounts Team | `accounts@example.com` | `AccountsPassword123!` |

### How to Test

1. Start the backend and frontend servers.
2. Open `http://localhost:5173` in your browser.
3. Log in using one of the demo accounts above.
4. Explore the features available to that role.

**Important:** These credentials are examples for local testing. They will work only if the corresponding accounts have already been created in the database. Public registration is intended for employee accounts; director and accounts accounts must be provisioned separately.

For security, use only disposable demo accounts with non-sensitive data. Do not reuse these passwords for real accounts or production deployments. If this repository is public, replace these demo passwords with newly generated, dedicated test credentials before publishing them.


## Assumptions Made During Development

The following assumptions were used while developing the system:

- Employees can register through the public registration endpoint, while director and accounts accounts are created separately through a controlled process.
- A newly created voucher begins in draft status.
- Employees can edit or delete their own vouchers only while they remain drafts.
- An employee must sign a voucher before submitting it for approval.
- A director must provide a signature when approving or rejecting a voucher.
- A rejection must include a reason.
- Receipt uploads are optional and support PDF, PNG, and JPEG files, with a maximum file size of 5 MB.
- The accounts team uses the application to review vouchers and does not approve or modify them.
- Authentication, role-based permissions, and password hashing are used to protect the application.

These assumptions describe the intended application behavior and should be checked against the final implementation before submission.

## Security Considerations

Passwords are hashed before being stored in the database. Protected API routes use JWT authentication and role-based access checks.

The application also restricts receipt upload types and file sizes. Environment files, database passwords, JWT secrets, and private uploaded receipts should not be committed to the public repository.

For a production deployment, additional testing and security checks would be appropriate.

## Future Improvements

Some possible improvements for a future version include:

- Email notifications for approval decisions.
- Expense reports and downloadable summaries.
- Automated tests for API routes and user permissions.
- Database migrations and automated test data setup.
- Audit logs for voucher changes and approval decisions.
- Deployment to a hosted server.

## Conclusion

This project provides a simple way to manage employee expense vouchers digitally. It brings voucher creation, receipt uploads, signatures, approval decisions, and accounts review into one application, making the process easier to follow and maintain.

## Author

**Name:** Siddharth Khatri  
**Project:** Expense Voucher Management System  
