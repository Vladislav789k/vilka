import HomePageClient from "./_components/HomePageClient";

export const revalidate = 60; // Cache for 60 seconds

export default function HomePage() {
  return <HomePageClient />;
}
