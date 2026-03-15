# Homeopathic Remedies Web Application

## Overview

This is a modern full-stack web application that provides comprehensive homeopathic remedy guidance. The application features an intuitive interface for browsing remedies by categories, searching by symptoms, and exploring detailed remedy information. Built with React and Express, it offers a clean user experience with responsive design and modern UI components.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Styling**: Tailwind CSS with shadcn/ui component library built on Radix UI primitives
- **Build Tool**: Vite for fast development and optimized production builds
- **Forms**: React Hook Form with Zod validation through @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules for modern JavaScript features
- **API Pattern**: RESTful API design with structured endpoints
- **Database ORM**: Drizzle ORM configured for PostgreSQL with type-safe queries
- **Session Management**: PostgreSQL session store with connect-pg-simple
- **Development**: TSX for TypeScript execution in development mode

### Design System
- **UI Components**: shadcn/ui component library providing consistent design patterns
- **Styling Framework**: Tailwind CSS with custom design system and CSS variables
- **Theme**: Neutral color palette with green primary color for health/wellness branding
- **Icons**: Lucide React for consistent iconography throughout the application
- **Responsive Design**: Mobile-first approach with responsive breakpoints

## Key Components

### Frontend Pages
1. **Home Page**: Main landing page with category selection and featured remedies
2. **Category Page**: Displays remedies filtered by specific categories (head, respiratory, etc.)
3. **Medicine Page**: Comprehensive list of all remedies with search and filtering
4. **Modalities Page**: Explores remedy modalities (conditions that make symptoms better/worse)
5. **Not Found Page**: 404 error handling with user-friendly messaging

### Core Components
1. **Header**: Navigation bar with branding, menu items, and responsive mobile menu
2. **CategoryCard**: Interactive cards for browsing remedy categories with icons and descriptions
3. **RemedyCard**: Detailed remedy information cards with symptoms, dosage, and favorite functionality
4. **SearchBar**: Global search functionality for remedies and symptoms
5. **KeywordSelector**: Multi-select symptom matching for intelligent remedy recommendations

### Backend Components
1. **Storage Layer**: Abstracted storage interface with in-memory implementation and database-ready structure
2. **API Routes**: RESTful endpoints for remedies, categories, keywords, and user favorites
3. **Middleware**: Request logging, error handling, and development tooling integration
4. **Session Management**: User authentication and session persistence

## Data Flow

### Client-Server Communication
1. **Frontend** makes API requests to Express backend endpoints
2. **React Query** manages caching, background updates, and loading states
3. **Express routes** handle business logic and data retrieval
4. **Storage layer** abstracts data access with repository pattern
5. **Response data** flows back through React Query to update UI components

### User Interaction Flow
1. User selects category or searches for symptoms
2. Frontend sends filtered requests to appropriate API endpoints
3. Backend queries storage layer for matching remedies
4. Results are cached by React Query and displayed in responsive cards
5. User can favorite remedies or explore detailed information

## External Dependencies

### Frontend Dependencies
- **@radix-ui**: Accessible UI primitives for complex components
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight routing solution
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Modern icon library
- **date-fns**: Date manipulation utilities

### Backend Dependencies
- **express**: Web application framework
- **drizzle-orm**: Type-safe database ORM
- **@neondatabase/serverless**: PostgreSQL database adapter
- **connect-pg-simple**: PostgreSQL session store
- **drizzle-zod**: Schema validation integration

### Development Dependencies
- **vite**: Fast build tool and development server
- **typescript**: Type checking and modern JavaScript features
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production

## Deployment Strategy

### Development Environment
- **Vite dev server** serves frontend with hot module replacement
- **TSX** runs backend with automatic TypeScript compilation
- **Concurrent development** with backend API and frontend served together
- **Replit integration** with development banner and error overlay

### Production Build
1. **Frontend build**: Vite builds React app to `dist/public` directory
2. **Backend build**: esbuild bundles server code to `dist/index.js`
3. **Static serving**: Express serves built frontend files in production
4. **Database migrations**: Drizzle Kit handles schema changes with `db:push` command

### Database Strategy
- **Development**: In-memory storage with seeded data for rapid prototyping
- **Production ready**: Drizzle ORM configured for PostgreSQL with migrations
- **Schema management**: Type-safe database schema with automatic TypeScript generation
- **Session storage**: PostgreSQL-based session management for user authentication

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string for production database
- **NODE_ENV**: Environment detection for development vs production behavior
- **Session configuration**: Secure session handling with database persistence