export type AuctionPagination = {
    start: number;
    end: number;
    pages: number[];
    showFirstPage: boolean;
    showLeadingEllipsis: boolean;
    showTrailingEllipsis: boolean;
    showLastPage: boolean;
};

export function getAuctionPagination(currentPage: number, totalPages: number, radius = 2): AuctionPagination {
    if (totalPages <= 1) {
        return {
            start: 1,
            end: 1,
            pages: [],
            showFirstPage: false,
            showLeadingEllipsis: false,
            showTrailingEllipsis: false,
            showLastPage: false,
        };
    }

    const start = Math.max(1, currentPage - radius);
    const end = Math.min(totalPages, currentPage + radius);
    const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

    return {
        start,
        end,
        pages,
        showFirstPage: start > 1,
        showLeadingEllipsis: start > 2,
        showTrailingEllipsis: end < totalPages - 1,
        showLastPage: end < totalPages,
    };
}
