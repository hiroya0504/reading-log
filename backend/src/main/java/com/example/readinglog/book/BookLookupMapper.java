package com.example.readinglog.book;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface BookLookupMapper {

  @Select(
      """
      SELECT id, user_id, title, author, isbn, total_pages, current_page,
             status, rating, note, created_at, updated_at
        FROM books
       WHERE user_id = #{userId} AND ${column} = #{value}
       ORDER BY created_at DESC, id DESC
      """)
  List<Book> findBy(
      @Param("userId") long userId, @Param("column") String column, @Param("value") String value);
}
