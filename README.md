# Date Palm Farm Management System (מערכת ניהול משק תמרים)

A comprehensive management system for date palm farms with inventory tracking, distributor management, order processing, and commission calculations.

## Features

### Core Functionality
- **FIFO Inventory Management**: Pallet-based tracking with oldest-first picking
- **Virtual Locking**: Reserve stock on order creation to prevent overselling
- **Dual Warehouse System**: Baqaa (Freezing) + Jerusalem (Cooling) with spoilage alerts
- **Dynamic Commission Engine**: Tiered rates (15%/17%/20%) with goods conversion
- **Hybrid Checkout**: Credit/Bit, Paybox, or Cash payment methods
- **Returns & Damage Handling**: Credit to account balance or record as waste
- **50kg Rule Alerts**: Performance tracking with minimum thresholds
- **Delivery Sheet Generation**: Per-hub quantities with spare inventory

### User Roles
- **Admin (Farm Manager)**: Full system access
- **Team Leaders**: Group management and performance oversight
- **Distributors (Hubs)**: Order placement and commission tracking

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Auth**: Supabase Auth with RLS

## Project Structure

```
DatesSystem/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/
│   │   ├── skills/       # Business logic modules
│   │   ├── supabase/     # Supabase clients
│   │   ├── db/           # Database layer
│   │   ├── hooks/        # Custom React hooks
│   │   ├── utils/        # Utility functions
│   │   └── types/        # TypeScript types
│   └── middleware.ts     # Auth middleware
├── supabase/             # Supabase configuration
├── CLAUDE.md             # Project memory & skills manual
└── supabase-schema.sql   # Database schema
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Add your Supabase credentials

4. Run the database migration:
   - Execute `supabase-schema.sql` in your Supabase SQL editor

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Database Schema

See `supabase-schema.sql` for the complete database schema including:
- 15 core tables
- 9 PostgreSQL ENUMs
- FIFO-optimized indexes
- Virtual locking mechanism
- RLS policies for all tables

## Development Roadmap

### Phase A (MVP) - Current
- Database setup
- Inventory management
- Order processing
- Dashboard interfaces

### Phase B - Planned
- Payment processor integration
- Automatic invoice generation

### Phase C - Future
- Marketing tools
- Referral links
- WhatsApp messaging

## Skills Architecture

Business logic is organized in `src/lib/skills/`:
- `inventory/` - FIFO and stock tracking
- `locking/` - Virtual reservation system
- `commissions/` - Calculation engine
- `checkout/` - Hybrid payment routing

## Documentation

- `CLAUDE.md` - Project memory and capability tracking
- `FOLDER_STRUCTURE.md` - Detailed folder organization
- `supabase-schema.sql` - Complete database schema

## License

Private - All Rights Reserved
