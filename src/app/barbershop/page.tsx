import BarbershopPageClient from "@/app/barbershop/BarbershopPageClient";

type PageProps = {
  searchParams: Promise<{
    campaign?: string | string[];
  }>;
};

export default async function PriorityBarbershopPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawCampaign = params.campaign;
  const campaign = Array.isArray(rawCampaign) ? rawCampaign[0] ?? null : rawCampaign ?? null;

  return <BarbershopPageClient campaign={campaign} />;
}
