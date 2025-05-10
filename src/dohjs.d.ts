
declare namespace doh {
  type RecordType =

    | "A"

    | "AAAA"

    | "AFSDB"

    | "APL"

    | "AXFR"

    | "CAA"

    | "CDNSKEY"

    | "CDS"

    | "CERT"

    | "CNAME"

    | "DNAME"

    | "DHCID"

    | "DLV"

    | "DNSKEY"

    | "DS"

    | "HINFO"

    | "HIP"

    | "IXFR"

    | "IPSECKEY"

    | "KEY"

    | "KX"

    | "LOC"

    | "MX"

    | "NAPTR"

    | "NS"

    | "NSEC"

    | "NSEC3"

    | "NSEC3PARAM"

    | "NULL"

    | "OPT"

    | "PTR"

    | "RRSIG"

    | "RP"

    | "SIG"

    | "SOA"

    | "SRV"

    | "SSHFP"

    | "TA"

    | "TKEY"

    | "TLSA"

    | "TSIG"

    | "TXT"

    | "URI";


  type RecordClass = "IN" | "CS" | "CH" | "HS" | "ANY";

  interface Question {
      type: RecordType;
      name: string;
      class?: RecordClass | undefined;
  }

  type StringRecordType = "A" | "AAAA" | "CNAME" | "DNAME" | "NS" | "PTR";

  export type OtherRecordType =

    | "AFSDB"

    | "APL"

    | "AXFR"

    | "CDNSKEY"

    | "CDS"

    | "CERT"

    | "DHCID"

    | "DLV"

    | "HIP"

    | "IPSECKEY"

    | "IXFR"

    | "KEY"

    | "KX"

    | "LOC"

    | "NSEC3PARAM"

    | "NULL"

    | "SIG"

    | "TA"

    | "TKEY"

    | "TSIG"

    | "URI";

  export interface GenericAnswer<T> {
    type: T;
    name: string;
  }

  export interface BaseAnswer<T, D> extends GenericAnswer<T> {
      ttl?: number | undefined;
      class?: RecordClass | undefined;
      flush?: boolean | undefined;
      data: D;
  }

  type StringAnswer = BaseAnswer<StringRecordType, string>;
  type BufferAnswer = BaseAnswer<OtherRecordType, Uint8Array>;
  type Answer =
    | StringAnswer
    | BufferAnswer;

  interface Packet {
    type?: "query" | "response" | undefined;
    id?: number | undefined;
    flags?: number | undefined;
    questions?: Question[] | undefined;
    answers?: Answer[] | undefined;
    authority?: Answer[] | undefined;
    additional?: Answer[] | undefined;
  }

  class DohResolver {
    constructor(nameserver_url: string);
    query(qname: string, qtype: string, method?: string): Promise<Packet>;
  }
}
