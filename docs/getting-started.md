# Getting Started

Welcome to the BAF (BoredAF) Developer Portal! This guide will help you get up and running with the BAF system.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PostgreSQL** (with pgvector extension)
- **Git**

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/andreeeiii/BoredAF.git
cd BoredAF
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
OPENAI_API_KEY=your_openai_api_key

# External APIs (Optional)
YOUTUBE_API_KEY=your_youtube_api_key
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application in action.

## Development Workflow

### Code Structure

```
src/
├── app/                    # Next.js app directory
│   ├── components/         # React components
│   ├── api/               # API routes
│   └── page.tsx          # Main page
├── lib/                   # Utility libraries
│   ├── agent/            # AI brain logic
│   ├── tools/            # External API integrations
│   └── supabase.ts       # Database client
└── __tests__/            # Test files
```

### Making Changes

1. **Create a new branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and add tests

3. **Run tests**:
   ```bash
   npm test
   ```

4. **Commit and push**:
   ```bash
   git commit -m "feat: add your feature"
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- **Unit tests**: Test individual functions and components
- **Integration tests**: Test API endpoints and database operations
- **E2E tests**: Test complete user workflows

### Writing Tests

```typescript
import { render, screen } from '@testing-library/react';
import { BafButton } from '../components/BafButton';

describe('BafButton', () => {
  it('should render correctly', () => {
    render(<BafButton />);
    expect(screen.getByText('BAF')).toBeInTheDocument();
  });

  it('should handle clicks', async () => {
    render(<BafButton />);
    const button = screen.getByText('BAF');
    
    await userEvent.click(button);
    
    // Test the click behavior
  });
});
```

## Database Setup

### PostgreSQL with pgvector

1. **Install PostgreSQL** (v14 or higher)
2. **Enable pgvector extension**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Create database**:
   ```sql
   CREATE DATABASE baf;
   ```

4. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

### Database Schema

The database uses the following main tables:

- **users**: User accounts and preferences
- **personas**: User persona data and learning
- **content_pool**: Available content suggestions
- **user_interactions**: User interaction history

## API Integration

### OpenAI Setup

1. **Get API key** from [OpenAI Platform](https://platform.openai.com/)
2. **Set environment variable**:
   ```bash
   OPENAI_API_KEY=your_api_key
   ```

### External APIs

#### YouTube
1. **Create Google Cloud Project**
2. **Enable YouTube Data API**
3. **Set API key** in environment variables

#### Twitch
1. **Create Twitch Developer Account**
2. **Create Application**
3. **Set client credentials** in environment variables

## Deployment

### Vercel (Recommended)

1. **Connect GitHub repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** automatically on push to master

### Self-Hosted

1. **Build application**:
   ```bash
   npm run build
   ```

2. **Start production server**:
   ```bash
   npm start
   ```

## Troubleshooting

### Common Issues

#### "Database connection failed"
- Check Supabase credentials
- Verify database is running
- Check network connectivity

#### "OpenAI API error"
- Verify API key is correct
- Check API quota and billing
- Ensure proper request formatting

#### "Build failed"
- Check TypeScript errors
- Verify all dependencies installed
- Check environment variables

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm run dev
```

### Performance Issues

1. **Check database queries** in Supabase dashboard
2. **Monitor API usage** in OpenAI dashboard
3. **Check response times** in browser dev tools

## Contributing

### Code Style

- Use **TypeScript** for all new code
- Follow **Prettier** formatting
- Write **tests** for new features
- Update **documentation** as needed

### Pull Request Process

1. **Fork** the repository
2. **Create feature branch**
3. **Make changes** with tests
4. **Submit pull request** with description
5. **Wait for code review**
6. **Merge** after approval

### Community

- **Discord**: Join our development community
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Contribute to docs

## Resources

### Documentation

- [Architecture Overview](brain-logic.md)
- [Data Schema](data-schema.md)
- [Economics Model](economics.md)
- [AI Context](ai-context.md)

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Support

- **Email**: support@boredaf.com
- **Discord**: [Join our server](https://discord.gg/boredaf)
- **GitHub**: [Create an issue](https://github.com/andreeeiii/BoredAF/issues)

---

Happy coding! 🚀
