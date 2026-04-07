# API Reference

This document provides comprehensive API documentation for the BAF system.

## Base URL

```
Development: http://localhost:3000/api
Production: https://boredaf.com/api
```

## Authentication

BAF uses Supabase Auth for authentication. Include the auth token in your requests:

```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

fetch('/api/baf', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## Core Endpoints

### POST /api/baf

Generate a personalized boredom alleviation suggestion.

#### Request Body

```typescript
interface BAFRequest {
  action: 'baf';
  context?: {
    mood?: string;
    location?: string;
    timeOfDay?: string;
    preferences?: string[];
  };
}
```

#### Response

```typescript
interface BAFResponse {
  success: boolean;
  data?: {
    suggestion: string;
    emoji: string;
    vibe: string;
    source: 'youtube' | 'twitch' | 'chess' | 'tiktok' | 'general';
    link: string | null;
    isLive?: boolean;
    archetype?: string;
    metadata?: {
      duration?: number;
      difficulty?: string;
      category?: string;
    };
  };
  error?: string;
  pressStatus?: {
    remaining: number;
    isPremium: boolean;
    credits: number;
  };
}
```

#### Example

```javascript
const response = await fetch('/api/baf', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'baf',
    context: {
      mood: 'bored',
      timeOfDay: 'evening'
    }
  })
});

const data = await response.json();
console.log(data.data.suggestion); // "Try learning a new coding skill"
```

### POST /api/baf/feedback

Submit feedback on a suggestion.

#### Request Body

```typescript
interface FeedbackRequest {
  action: 'feedback';
  suggestionId: string;
  feedback: 'accept' | 'reject' | 'neutral';
  rating?: number; // 1-5
  comment?: string;
}
```

#### Response

```typescript
interface FeedbackResponse {
  success: boolean;
  message?: string;
  updatedPersona?: boolean;
}
```

### GET /api/persona

Get user's current persona data.

#### Response

```typescript
interface PersonaResponse {
  success: boolean;
  data?: {
    archetypeWeights: {
      entertainment: number;
      productivity: number;
      social: number;
      learning: number;
      creativity: number;
      relaxation: number;
    };
    moodState: {
      current: string;
      intensity: number;
      context: string;
    };
    preferences: {
      platforms: Record<string, number>;
      contentTypes: Record<string, number>;
    };
  };
}
```

### PUT /api/persona

Update user's persona preferences.

#### Request Body

```typescript
interface UpdatePersonaRequest {
  archetypeWeights?: Partial<Record<string, number>>;
  preferences?: {
    platforms?: Record<string, number>;
    contentTypes?: Record<string, number>;
  };
}
```

## Content Sources

### GET /api/content/sources

Get available content sources.

#### Response

```typescript
interface SourcesResponse {
  success: boolean;
  data?: {
    youtube: {
      enabled: boolean;
      categories: string[];
      quality: 'high' | 'medium' | 'low';
    };
    twitch: {
      enabled: boolean;
      liveStreams: number;
      categories: string[];
    };
    chess: {
      enabled: boolean;
      difficulty: ['easy', 'medium', 'hard'];
    };
    tiktok: {
      enabled: boolean;
      categories: string[];
    };
  };
}
```

### GET /api/content/search

Search for specific content.

#### Query Parameters

```typescript
interface SearchParams {
  q: string;           // Search query
  source?: string;     // Content source filter
  category?: string;   // Category filter
  limit?: number;      // Result limit (default: 20)
}
```

#### Response

```typescript
interface SearchResponse {
  success: boolean;
  data?: Array<{
    id: string;
    title: string;
    description: string;
    source: string;
    url: string;
    thumbnail?: string;
    duration?: number;
    quality: number;
    metadata: Record<string, any>;
  }>;
}
```

## User Management

### GET /api/user/profile

Get user profile information.

#### Response

```typescript
interface ProfileResponse {
  success: boolean;
  data?: {
    id: string;
    email: string;
    username?: string;
    subscriptionTier: 'free' | 'premium' | 'pro';
    createdAt: string;
    lastActive: string;
    stats: {
      totalBAFs: number;
      averageRating: number;
      favoriteCategories: string[];
    };
  };
}
```

### PUT /api/user/preferences

Update user preferences.

#### Request Body

```typescript
interface UpdatePreferencesRequest {
  notifications?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'never';
  };
  privacy?: {
    dataCollection: boolean;
    analytics: boolean;
  };
  ui?: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
  };
}
```

## Analytics

### GET /api/analytics/user

Get user-specific analytics.

#### Response

```typescript
interface UserAnalyticsResponse {
  success: boolean;
  data?: {
    usage: {
      dailyBAFs: number[];
      weeklyBAFs: number;
      monthlyBAFs: number;
    };
    satisfaction: {
      averageRating: number;
      positiveFeedback: number;
      negativeFeedback: number;
    };
    trends: {
      favoriteCategories: Array<{category: string; count: number}>;
      peakUsage: Array<{hour: number; count: number}>;
    };
  };
}
```

### GET /api/analytics/system

Get system-wide analytics (admin only).

#### Response

```typescript
interface SystemAnalyticsResponse {
  success: boolean;
  data?: {
    users: {
      total: number;
      active: number;
      new: number;
      retention: number;
    };
    performance: {
      averageResponseTime: number;
      successRate: number;
      errorRate: number;
    };
    economics: {
      dailyCost: number;
      monthlyRevenue: number;
      costPerBAF: number;
    };
  };
}
```

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTH_REQUIRED` | Authentication required | 401 |
| `AUTH_INVALID` | Invalid authentication token | 401 |
| `RATE_LIMITED` | Rate limit exceeded | 429 |
| `QUOTA_EXCEEDED` | Daily quota exceeded | 429 |
| `INVALID_REQUEST` | Invalid request format | 400 |
| `CONTENT_NOT_FOUND` | No suitable content found | 404 |
| `SERVICE_UNAVAILABLE` | External service unavailable | 503 |
| `INTERNAL_ERROR` | Internal server error | 500 |

### Rate Limiting

| Tier | Requests/Day | Requests/Hour |
|------|--------------|---------------|
| Free | 3 | 3 |
| Premium | 50 | 10 |
| Pro | Unlimited | 100 |

## SDK Examples

### JavaScript/TypeScript

```typescript
import { BAFClient } from '@boredaf/sdk';

const client = new BAFClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.boredaf.com'
});

// Get a suggestion
const suggestion = await client.getBAF({
  context: {
    mood: 'creative',
    timeOfDay: 'morning'
  }
});

// Submit feedback
await client.submitFeedback({
  suggestionId: suggestion.id,
  feedback: 'accept',
  rating: 5
});
```

### Python

```python
from boredaf_sdk import BAFClient

client = BAFClient(api_key='your-api-key')

# Get a suggestion
suggestion = client.get_baf(
    context={
        'mood': 'creative',
        'time_of_day': 'morning'
    }
)

# Submit feedback
client.submit_feedback(
    suggestion_id=suggestion['id'],
    feedback='accept',
    rating=5
)
```

### cURL

```bash
# Get a suggestion
curl -X POST https://api.boredaf.com/api/baf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "baf",
    "context": {
      "mood": "creative",
      "timeOfDay": "morning"
    }
  }'

# Submit feedback
curl -X POST https://api.boredaf.com/api/baf/feedback \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "feedback",
    "suggestionId": "suggestion-123",
    "feedback": "accept",
    "rating": 5
  }'
```

## Webhooks

### Configure Webhooks

Webhooks allow you to receive real-time notifications about user events.

#### Supported Events

- `user.created` - New user registration
- `baf.requested` - User requested a suggestion
- `feedback.submitted` - User submitted feedback
- `subscription.changed` - User subscription changed

#### Webhook Payload

```typescript
interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    userId: string;
    [key: string]: any;
  };
  signature: string; // HMAC-SHA256 signature
}
```

#### Verify Webhook Signature

```typescript
import crypto from 'crypto';

const verifyWebhook = (payload: string, signature: string, secret: string): boolean => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
};
```

## Testing

### Test Environment

Use the test environment for development:

```
Base URL: https://test-api.boredaf.com
```

### Mock Responses

The test environment returns mock data for testing purposes:

```typescript
// Mock BAF response
{
  "success": true,
  "data": {
    "suggestion": "Try learning a new programming language",
    "emoji": "💻",
    "vibe": "educational",
    "source": "general",
    "link": null,
    "archetype": "The Creator"
  }
}
```

---

For more information, check out the [Getting Started Guide](getting-started.md) or [AI Context](ai-context.md).
