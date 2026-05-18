// api/sheets.js

export default async function handler(req, res) {
  try {
    const API_URL =
      "https://script.google.com/macros/s/AKfycbxbqXBC5VAlVCifAXsXsNJO1NiX8BbnZbV1dsmkTgXwBt-U4Iu8XHwGvdMURPiJN-fA/exec";

    const action =
      req.method === "GET"
        ? req.query.action
        : req.body.action;

    let response;

    if (req.method === "GET") {
      const params = new URLSearchParams(req.query).toString();

      response = await fetch(`${API_URL}?${params}`);
    } else {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(req.body)
      });
    }

    const data = await response.json();

    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
}