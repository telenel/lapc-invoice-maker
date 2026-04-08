import { AccountRequestForm } from "@/components/follow-up/account-request-form";

export default async function AccountRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AccountRequestForm token={token} />;
}
