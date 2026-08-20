export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;

    const response = await fetch(`${origin}/api/portfolio`, {
      cache: "no-store",
    });

    const portfolio = await response.json();

    if (!response.ok || portfolio.status !== "ok") {
      return Response.json(
        {
          error: "Could not load portfolio",
          details: portfolio,
        },
        { status: 502 }
      );
    }

    // Aggregate identical assets across wallets while removing wallet addresses.
    const assetMap = new Map<string, any>();

    for (const position of portfolio.positions ?? []) {
      const key =
        `${position.chain}:${position.tokenAddress ?? position.symbol}`;

      const existing = assetMap.get(key);

      if (!existing) {
        assetMap.set(key, {
          chain: position.chain,
          tokenAddress: position.tokenAddress,
          symbol: position.symbol,
          name: position.name,

          balance: Number(position.balance ?? 0),

          priceUsd:
            typeof position.priceUsd === "number"
              ? position.priceUsd
              : null,

          valueUsd:
            typeof position.valueUsd === "number"
              ? position.valueUsd
              : null,

          priceSource:
            position.priceSource ?? null,

          liquidityUsd:
            typeof position.liquidityUsd === "number"
              ? position.liquidityUsd
              : null,

          priceChange24h:
            typeof position.priceChange24h === "number"
              ? position.priceChange24h
              : null,
        });

        continue;
      }

      existing.balance += Number(position.balance ?? 0);

      if (typeof position.valueUsd === "number") {
        existing.valueUsd =
          (existing.valueUsd ?? 0) + position.valueUsd;
      }

      if (
        existing.priceUsd === null &&
        typeof position.priceUsd === "number"
      ) {
        existing.priceUsd = position.priceUsd;
      }

      if (
        existing.liquidityUsd === null &&
        typeof position.liquidityUsd === "number"
      ) {
        existing.liquidityUsd = position.liquidityUsd;
      }

      if (
        existing.priceChange24h === null &&
        typeof position.priceChange24h === "number"
      ) {
        existing.priceChange24h = position.priceChange24h;
      }
    }

    const positions = [...assetMap.values()].sort(
      (a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1)
    );

    return Response.json({
      status: "ok",
      updatedAt: portfolio.updatedAt,

      summary: {
        knownValueUsd:
          portfolio.valuation?.knownValueUsd ?? null,

        pricedPositions:
          portfolio.valuation?.pricedPositions ?? null,

        unpricedPositions:
          portfolio.valuation?.unpricedPositions ?? null,

        uniqueAssets: positions.length,
      },

      positions,

      privacy: {
        walletAddressesIncluded: false,
        apiKeysIncluded: false,
        signingCapability: false,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: "Feed generation failed",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}
