import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// GET: 발주 내역 전체 조회
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();
    const orders = await db
      .collection("card_orders")
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const result = orders.map((o) => ({
      ...o,
      _id: o._id.toString(),
      createdAt: o.createdAt?.toISOString?.() ?? o.createdAt,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("발주 내역 조회 실패:", err);
    return NextResponse.json([], { status: 200 });
  }
}

// POST: 발주 목록 저장 (PDF 생성 없이 DB만 저장)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { people, month } = body;

    if (!Array.isArray(people) || people.length === 0) {
      return NextResponse.json({ error: "직원 정보가 없습니다" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const now = new Date();

    const result = await db.collection("card_orders").insertOne({
      month: month || "0000-00",
      peopleCount: people.length,
      people,
      createdAt: now,
      createdAtKST: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    });

    return NextResponse.json({ ok: true, id: result.insertedId.toString() });
  } catch (err) {
    console.error("발주 목록 저장 실패:", err);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}

// PUT: 발주 내역 수정
export async function PUT(req: NextRequest) {
  try {
    const { id, people, month } = await req.json();
    if (!id || !Array.isArray(people) || people.length === 0) {
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const now = new Date();

    await db.collection("card_orders").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          month: month || "0000-00",
          peopleCount: people.length,
          people,
          updatedAt: now,
          updatedAtKST: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("발주 내역 수정 실패:", err);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

// DELETE: 발주 내역 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id 없음" }, { status: 400 });

    const client = await clientPromise;
    const db = client.db();
    await db.collection("card_orders").deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("발주 내역 삭제 실패:", err);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
