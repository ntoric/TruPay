import PageHeader from "@/components/layout/page-header";
import CustomerForm from "@/components/customers/customer-form";
import { createCustomer } from "@/app/actions/customers";

export default function NewCustomerPage() {
  return (
    <div>
      <PageHeader title="Add customer" description="Create a new customer record." />
      <CustomerForm action={createCustomer} submitLabel="Create customer" />
    </div>
  );
}
