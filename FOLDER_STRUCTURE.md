# Next.js 14 Folder Structure - Date Palm Farm Management System

## Proposed Structure

```
DatesSystem/
│
├── CLAUDE.md                          # Project memory & skill manual
├── supabase-schema.sql                # Database schema
├── FOLDER_STRUCTURE.md                # This file
│
├── .env.local                         # Environment variables (Supabase keys)
├── .env.example                       # Example env file
├── next.config.js                     # Next.js configuration
├── tailwind.config.ts                 # Tailwind configuration
├── tsconfig.json                      # TypeScript configuration
├── package.json
│
├── public/                            # Static assets
│   ├── images/
│   └── icons/
│
├── src/
│   │
│   ├── app/                           # Next.js 14 App Router
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Home page
│   │   ├── globals.css                # Global styles
│   │   │
│   │   ├── (auth)/                    # Auth route group
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── signup/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/               # Protected routes group
│   │   │   ├── layout.tsx             # Dashboard layout
│   │   │   │
│   │   │   ├── dashboard/             # Main dashboard
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── inventory/             # Inventory management
│   │   │   │   ├── page.tsx           # List view
│   │   │   │   ├── [id]/              # Pallet details
│   │   │   │   │   └── page.tsx
│   │   │   │   └── new/               # Add new pallet
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── orders/                # Order management
│   │   │   │   ├── page.tsx           # Orders list
│   │   │   │   ├── [id]/              # Order details
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── new/               # Create order
│   │   │   │   │   └── page.tsx
│   │   │   │   └── checkout/          # Hybrid checkout
│   │   │   │       └── [orderId]/
│   │   │   │           └── page.tsx
│   │   │   │
│   │   │   ├── distributors/          # Distributor management (admin only)
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── commissions/           # Commission tracking
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   └── profile/               # User profile
│   │   │       └── page.tsx
│   │   │
│   │   └── api/                       # API routes
│   │       ├── orders/
│   │       │   ├── route.ts           # GET, POST orders
│   │       │   ├── [id]/
│   │       │   │   └── route.ts       # GET, PATCH, DELETE order
│   │       │   └── reserve/
│   │       │       └── route.ts       # Virtual lock stock
│   │       │
│   │       ├── inventory/
│   │       │   ├── route.ts
│   │       │   ├── available/
│   │       │   │   └── route.ts       # Get available stock
│   │       │   └── fifo/
│   │       │       └── route.ts       # FIFO suggestions
│   │       │
│   │       ├── commissions/
│   │       │   ├── route.ts
│   │       │   └── calculate/
│   │       │       └── route.ts       # Calculate commissions
│   │       │
│   │       └── webhooks/
│   │           └── payment/
│   │               └── route.ts       # Payment webhooks
│   │
│   ├── components/                    # React components
│   │   ├── ui/                        # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── form-input.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/                    # Layout components
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── footer.tsx
│   │   │   └── dashboard-nav.tsx
│   │   │
│   │   ├── inventory/                 # Inventory-specific components
│   │   │   ├── pallet-card.tsx
│   │   │   ├── stock-indicator.tsx
│   │   │   └── fifo-picker.tsx
│   │   │
│   │   ├── orders/                    # Order-specific components
│   │   │   ├── order-form.tsx
│   │   │   ├── order-item-list.tsx
│   │   │   └── order-summary.tsx
│   │   │
│   │   ├── checkout/                  # Checkout components
│   │   │   ├── payment-method-selector.tsx
│   │   │   ├── credit-card-form.tsx
│   │   │   ├── paybox-display.tsx
│   │   │   └── cash-instructions.tsx
│   │   │
│   │   └── commissions/               # Commission components
│   │       ├── commission-table.tsx
│   │       └── commission-calculator.tsx
│   │
│   ├── lib/                           # Core library code
│   │   │
│   │   ├── skills/                    # 🎯 BUSINESS LOGIC SKILLS
│   │   │   │
│   │   │   ├── inventory/
│   │   │   │   ├── fifo.ts            # FIFO logic
│   │   │   │   ├── stock-tracker.ts   # Stock tracking utilities
│   │   │   │   └── pallet-manager.ts  # Pallet operations
│   │   │   │
│   │   │   ├── locking/
│   │   │   │   ├── virtual-lock.ts    # Virtual locking mechanism
│   │   │   │   └── reservation.ts     # Reservation management
│   │   │   │
│   │   │   ├── commissions/
│   │   │   │   ├── calculator.ts      # Commission calculation engine
│   │   │   │   ├── tiers.ts           # Tiered rates logic
│   │   │   │   └── goods-converter.ts # NIS to goods conversion
│   │   │   │
│   │   │   └── checkout/
│   │   │       ├── hybrid-checkout.ts # Hybrid checkout orchestrator
│   │   │       └── payment-router.ts  # Payment method routing
│   │   │
│   │   ├── supabase/                  # Supabase client & utilities
│   │   │   ├── client.ts              # Browser client
│   │   │   ├── server.ts              # Server client
│   │   │   └── middleware.ts          # Auth middleware
│   │   │
│   │   ├── db/                        # Database layer (Drizzle/Prisma)
│   │   │   ├── schema.ts              # ORM schema
│   │   │   ├── client.ts              # DB client
│   │   │   └── queries/               # Reusable queries
│   │   │       ├── orders.ts
│   │   │       ├── inventory.ts
│   │   │       └── commissions.ts
│   │   │
│   │   ├── hooks/                     # Custom React hooks
│   │   │   ├── use-user.ts
│   │   │   ├── use-orders.ts
│   │   │   ├── use-inventory.ts
│   │   │   └── use-commissions.ts
│   │   │
│   │   ├── utils/                     # Utility functions
│   │   │   ├── format.ts              # Formatting helpers
│   │   │   ├── validation.ts          # Validation schemas
│   │   │   └── constants.ts           # App constants
│   │   │
│   │   └── types/                     # TypeScript types
│   │       ├── database.ts            # Database types
│   │       ├── models.ts              # Business models
│   │       └── api.ts                 # API types
│   │
│   └── middleware.ts                  # Next.js middleware (auth)
│
├── supabase/                          # Supabase configuration
│   ├── migrations/                    # Database migrations
│   │   └── 0001_initial_schema.sql
│   └── config.toml                    # Supabase config
│
└── tests/                             # Tests
    ├── unit/
    │   ├── skills/                    # Test business logic
    │   │   ├── fifo.test.ts
    │   │   ├── virtual-lock.test.ts
    │   │   └── commissions.test.ts
    │   └── utils/
    │
    └── integration/
        ├── orders.test.ts
        └── checkout.test.ts
```

## Key Design Decisions

### 1. **App Router Structure**
- Using route groups `(auth)` and `(dashboard)` for clean organization
- Separate layouts for authenticated vs public routes

### 2. **Skills Directory** (`src/lib/skills/`)
- **Core principle**: All complex business logic lives here
- Each skill is a self-contained module
- Skills can import from each other but remain decoupled
- Components and API routes consume skills, never implement logic

### 3. **Database Layer**
- Separate `db/` for ORM-specific code
- `supabase/` for Supabase-specific clients
- Query builders in `db/queries/` for reusability

### 4. **Component Organization**
- `ui/`: Generic, reusable components
- Feature-specific folders: `inventory/`, `orders/`, `checkout/`
- Clear separation between presentational and container components

### 5. **API Routes**
- RESTful structure under `/api`
- Each resource has its own folder
- Special routes for business operations (`reserve`, `calculate`, etc.)

### 6. **Type Safety**
- All database types generated from Supabase
- Business model types in `types/models.ts`
- API contract types in `types/api.ts`

## Development Workflow

1. **Start with Skills**: Implement `@/lib/skills` first (FIFO, Virtual Lock, etc.)
2. **Add API Routes**: Create endpoints that use the skills
3. **Build Components**: UI that consumes the APIs
4. **Wire Pages**: Connect everything in the App Router

## Next Steps

Once this structure is approved:
1. Initialize Next.js project with TypeScript
2. Install dependencies (Supabase, Drizzle/Prisma, Tailwind)
3. Create the folder structure
4. Begin implementing skills in order of dependency
