import { ResultMessagev2 } from "./server.js";

enum NIPKinds {
	NIP98 = 27235,
	NIP94 = 1063,
	NIP96 = 10096,
}

interface NIP96file {
    api_url: string,
    download_url: string,
    supported_nips: number[],
    tos_url: string,
    content_types: string[],
    plans: {
        free: {
            name: string,
            is_nip98_required: boolean,
            url: string,
            max_byte_size: number,
            file_expiration: number[],
            media_transformations: {
                "image": string[],
                "video": string[],
            }
        }
    }
}

interface NIP94_event {
    id : string,
    pubkey: string,
    created_at: number,
    kind: NIPKinds.NIP94,
    tags: [
            ["url", string],
            ["m", string],
            ["x", string],
            ["ox", string],
            ["size", string],
            ["dim",string],
            ["magnet", string],
            ["i", string],
            ["blurhash", string]
    ],
    content: string,
    sig : string,

  }

interface NIP96_event extends ResultMessagev2{

    processing_url: string,
	nip94_event : NIP94_event

}


interface NIP04_event{
    kind: number,
    created_at: number,
    tags: [["p", string]],
    content: string,
}

interface NIP96_processing extends ResultMessagev2{
    percentage : number,
}

export { NIPKinds, NIP96file, NIP94_event, NIP96_event, NIP96_processing, NIP04_event};