import { TLBookmarkAsset, AssetRecordType, getHashForString } from "tldraw"
import { WORKER_URL } from "../routes/Board"

export async function unfurlBookmarkUrl({
  url,
}: {
  url: string
}): Promise<TLBookmarkAsset> {
  const asset: TLBookmarkAsset = {
    id: AssetRecordType.createId(getHashForString(url)),
    typeName: "asset",
    type: "bookmark",
    meta: {},
    props: {
      src: url,
      description: "",
      image: "",
      favicon: "",
      title: "",
    },
  }

  try {
    const response = await fetch(
      `${WORKER_URL}/unfurl?url=${encodeURIComponent(url)}`,
    )
    const data = (await response.json()) as {
      description: string
      image: string
      favicon: string
      title: string
    }

    asset.props.description = data?.description ?? ""
    asset.props.image = data?.image ?? ""
    asset.props.favicon = data?.favicon ?? ""
    asset.props.title = data?.title ?? ""
  } catch (e) {
    console.error(e)
  }

  return asset
}
