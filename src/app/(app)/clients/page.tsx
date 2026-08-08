import Link from "next/link"
import { desc } from "drizzle-orm"

import { db } from "@/db"
import { clients } from "@/db/schema"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function ClientsPage() {
  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt))

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Clients</h1>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No clients yet. Start one from New Counselling.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>{client.phone ?? "—"}</TableCell>
                    <TableCell>{client.city ?? "—"}</TableCell>
                    <TableCell>{client.createdAt.toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
