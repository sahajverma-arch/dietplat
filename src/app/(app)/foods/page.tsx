import { asc } from "drizzle-orm"

import { db } from "@/db"
import { exchangeTypes, foods } from "@/db/schema"
import { FoodsTable } from "@/components/foods/foods-table"

export default async function FoodsPage() {
  const [foodRows, exchangeTypeRows] = await Promise.all([
    db.select().from(foods).orderBy(asc(foods.nameEn)),
    db.select().from(exchangeTypes).orderBy(asc(exchangeTypes.sortOrder)),
  ])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Foods</h1>
      <FoodsTable foods={foodRows} exchangeTypes={exchangeTypeRows} />
    </div>
  )
}
