const BUCKET_NAME = 'r2-page-video';
const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const LOOKBACK_HOURS = 24;

const QUERY = `
  query GetR2Storage($accountTag: String!, $bucketName: String!, $datetime: Time!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        r2StorageAdaptiveGroups(
          limit: 1
          filter: { bucketName: $bucketName, datetime_geq: $datetime }
          orderBy: [datetime_DESC]
        ) {
          dimensions {
            datetime
          }
          max {
            payloadSize
            metadataSize
          }
        }
      }
    }
  }
`;

export async function getR2StorageSize(
  accountId: string,
  apiToken: string
): Promise<number> {
  const datetime = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { accountTag: accountId, bucketName: BUCKET_NAME, datetime },
    }),
  });

  if (!res.ok) {
    throw new Error(`R2 analytics HTTP ${res.status}`);
  }

  const data = await res.json<{
    data?: {
      viewer?: {
        accounts?: Array<{
          r2StorageAdaptiveGroups?: Array<{
            dimensions?: { datetime?: string };
            max?: { payloadSize?: number; metadataSize?: number };
          }>;
        }>;
      };
    };
    errors?: Array<{ message: string }>;
  }>();

  if (data.errors && data.errors.length > 0) {
    throw new Error(`R2 analytics GraphQL error: ${data.errors[0].message}`);
  }

  const groups = data.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups;
  if (!groups || groups.length === 0) return 0;

  const max = groups[0].max ?? {};
  return (max.payloadSize ?? 0) + (max.metadataSize ?? 0);
}
